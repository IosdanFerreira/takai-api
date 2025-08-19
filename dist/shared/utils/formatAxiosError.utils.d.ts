export declare function formatAxiosError(error: any): {
    message: string;
    code: string;
    url: string;
    method: string;
    data: any;
    status: number;
} | {
    message: string;
    code?: undefined;
    url?: undefined;
    method?: undefined;
    data?: undefined;
    status?: undefined;
};
