"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var OmniaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OmniaService = void 0;
const https = require("https");
const common_1 = require("@nestjs/common");
const axios_1 = require("axios");
const config_1 = require("@nestjs/config");
let OmniaService = OmniaService_1 = class OmniaService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(OmniaService_1.name);
        const httpsAgent = new https.Agent({ rejectUnauthorized: false });
        this.api = axios_1.default.create({
            baseURL: this.configService.get('OMNIA_API_URL'),
            timeout: 60000,
            httpsAgent,
        });
    }
    formatAxiosError(error) {
        if (error instanceof axios_1.AxiosError) {
            return {
                message: error.message,
                code: error.code,
                url: error.config?.url,
                method: error.config?.method,
                status: error.response?.status,
                data: error.response?.data,
            };
        }
        return { message: error.message || String(error) };
    }
    async getToken() {
        const username = this.configService.get('OMNIA_API_USERNAME');
        const password = this.configService.get('OMNIA_API_PASSWORD');
        if (!username || !password) {
            throw new Error('Credenciais de API não configuradas');
        }
        try {
            const authResponse = await this.api.post('/token', {}, {
                auth: { username, password },
            });
            this.logger.log('Novo token gerado com sucesso');
            return authResponse.data.token;
        }
        catch (error) {
            const formatted = this.formatAxiosError(error);
            this.logger.error('Falha na autenticação com a API Omnia', JSON.stringify(formatted));
            throw new Error('Falha na autenticação com a API Omnia: ' + formatted.message);
        }
    }
    async getClientByCpfOrCnpj(cpfOrCnpj) {
        if (!cpfOrCnpj) {
            throw new Error('CPF/CNPJ não informado');
        }
        try {
            const token = await this.getToken();
            const response = await this.api.get(`/api/clientes/${cpfOrCnpj}/cnpjcpf`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            return response.data;
        }
        catch (error) {
            const formatted = this.formatAxiosError(error);
            this.logger.error(`Erro ao buscar cliente ${cpfOrCnpj}`, JSON.stringify(formatted));
            throw new Error(`Falha ao buscar cliente: ${formatted.message}`);
        }
    }
    async fetchAllPagesConcurrent(endpoint, token, concurrency = 5, maxRetries = 3) {
        const pageSize = 1000;
        const fetchPage = async (page, attempt = 1) => {
            try {
                const response = await this.api.get(`${endpoint}?page=${page}&pagesize=${pageSize}`, { headers: { Authorization: `Bearer ${token}` } });
                return response.data.data;
            }
            catch (error) {
                if (attempt <= maxRetries) {
                    const delay = 1000 * attempt;
                    this.logger.warn(`Falha ao buscar página ${page} (tentativa ${attempt}). Retentando em ${delay}ms...`);
                    await new Promise((res) => setTimeout(res, delay));
                    return fetchPage(page, attempt + 1);
                }
                const formatted = this.formatAxiosError(error);
                this.logger.error(`Página ${page} falhou após ${maxRetries} tentativas.`, JSON.stringify(formatted));
                return [];
            }
        };
        const firstResponse = await this.api.get(`${endpoint}?page=1&pagesize=${pageSize}`, { headers: { Authorization: `Bearer ${token}` } });
        const totalPages = firstResponse.data.pagination.totalpages;
        const results = [...firstResponse.data.data];
        const pages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
        for (let i = 0; i < pages.length; i += concurrency) {
            const batch = pages.slice(i, i + concurrency);
            const batchResults = await Promise.all(batch.map((page) => fetchPage(page)));
            batchResults.forEach((pageData) => results.push(...pageData));
        }
        return results;
    }
    async getProducts() {
        try {
            const token = await this.getToken();
            return this.fetchAllPagesConcurrent('/api/v1/produtos', token);
        }
        catch (error) {
            const formatted = this.formatAxiosError(error);
            this.logger.error('Erro ao buscar produtos', JSON.stringify(formatted));
            throw new Error(`Falha ao buscar produtos: ${formatted.message}`);
        }
    }
    async getStock() {
        try {
            const token = await this.getToken();
            this.logger.log('Buscando estoques...');
            return this.fetchAllPagesConcurrent('/api/v1/estoques', token);
        }
        catch (error) {
            const formatted = this.formatAxiosError(error);
            this.logger.error('Erro ao buscar estoques', JSON.stringify(formatted));
            throw new Error(`Falha ao buscar estoques: ${formatted.message}`);
        }
    }
    async getPrices() {
        try {
            const token = await this.getToken();
            this.logger.log('Buscando preços...');
            return this.fetchAllPagesConcurrent('/api/v1/precos', token);
        }
        catch (error) {
            const formatted = this.formatAxiosError(error);
            this.logger.error('Erro ao buscar preços', JSON.stringify(formatted));
            throw new Error(`Falha ao buscar preços: ${formatted.message}`);
        }
    }
    async createClient(client) {
        const token = await this.getToken();
        this.logger.log('Criando cliente...');
        try {
            const response = await this.api.post('/api/va/clientes', client, {
                headers: { Authorization: `Bearer ${token}` },
            });
            return response.data;
        }
        catch (error) {
            const formatted = this.formatAxiosError(error);
            this.logger.error('Erro ao criar cliente', JSON.stringify(formatted));
            throw new Error(`Falha ao criar cliente: ${formatted.message}`);
        }
    }
    async createOrder(order) {
        const token = await this.getToken();
        this.logger.log('Criando pedido...');
        try {
            const response = await this.api.post('/api/v1/pedidos', order, {
                headers: { Authorization: `Bearer ${token}` },
            });
            return response.data;
        }
        catch (error) {
            const formatted = this.formatAxiosError(error);
            this.logger.error('Erro ao criar pedido', JSON.stringify(formatted));
            throw new Error(`Falha ao criar pedido: ${formatted.message}`);
        }
    }
};
exports.OmniaService = OmniaService;
exports.OmniaService = OmniaService = OmniaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], OmniaService);
//# sourceMappingURL=omnia.service.js.map