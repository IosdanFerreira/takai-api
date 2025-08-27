export interface CreateOmniClientDto {
  codfilial: string;
  cgcent: string;
  ieent: string;
  cliente: string;
  fantasia: string;
  emailnfe: string;
  codcidadeibge?: string; // pode ser opcional, já que depende do CEP/ibgeCode
  enderent: string;
  numeroent: string;
  complementoent?: string;
  bairroent: string;
  municent: string;
  estent: string;
  cepent: string;
  telent: string;
  telcelent: string;
}
