import { PaginationInterface } from '../../../shared/interfaces/pagination.interface';
export interface OmniaPaginatedResponse<T> {
    pagination: PaginationInterface;
    data: T[];
}
