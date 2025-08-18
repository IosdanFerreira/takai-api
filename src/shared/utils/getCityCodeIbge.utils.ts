import axios from 'axios';

export async function getIbgeCodeByCep(cep: string): Promise<string | null> {
  try {
    // Remove traços e espaços
    const cleanedCep = cep.replace(/\D/g, '');

    const response = await axios.get(
      `https://viacep.com.br/ws/${cleanedCep}/json/`,
    );

    if (response.data && response.data.ibge) {
      return response.data.ibge;
    } else {
      console.warn('CEP não encontrado ou inválido');
      return null;
    }
  } catch (error) {
    console.error('Erro ao consultar o CEP:', error);
    return null;
  }
}
