export interface PaginationInterface {
  currentpage: number;
  pagesize: number;
  totalrecords: number;
  totalpages: number;
  hasnextpage: boolean;
  haspreviouspage: boolean;
}
