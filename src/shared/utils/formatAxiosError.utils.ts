import { AxiosError } from 'axios';

export function formatAxiosError(error: any) {
  if (error instanceof AxiosError) {
    return {
      message: error.message,
      code: error.code,
      url: error.config?.url,
      method: error.config?.method,
      data: error.response?.data,
      status: error.response?.status,
    };
  }

  return { message: (error as Error).message || String(error) };
}
