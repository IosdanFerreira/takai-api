"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIbgeCodeByCep = getIbgeCodeByCep;
const axios_1 = require("axios");
async function getIbgeCodeByCep(cep) {
    try {
        const cleanedCep = cep.replace(/\D/g, '');
        const response = await axios_1.default.get(`https://viacep.com.br/ws/${cleanedCep}/json/`);
        if (response.data && response.data.ibge) {
            return response.data.ibge;
        }
        else {
            console.warn('CEP não encontrado ou inválido');
            return null;
        }
    }
    catch (error) {
        console.error('Erro ao consultar o CEP:', error);
        return null;
    }
}
//# sourceMappingURL=getCityCodeIbge.utils.js.map