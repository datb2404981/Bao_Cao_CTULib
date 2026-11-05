/**
 * apps/frontend/src/types/author.ts
 * Định nghĩa các kiểu dữ liệu cho module Quản lý Tác giả (SC16) khớp với backend schema và API contracts.
 * Tuân thủ "erasableSyntaxOnly: true".
 */

export interface Author {
  _id: string;
  fullName: string;
  affiliation?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAuthorPayload {
  fullName: string;
  affiliation?: string;
  notes?: string;
}

export interface UpdateAuthorPayload {
  fullName: string;
  affiliation?: string;
  notes?: string;
}

export interface ApiResponse<T> {
  status: 'success' | 'error';
  message?: string;
  data: T;
}

export interface ValidationErrorItem {
  field?: string;
  path?: string[];
  message: string;
}

export class AuthorApiError extends Error {
  status: number;
  fields: Record<string, string>;
  data?: unknown;

  constructor(message: string, status: number, fields: Record<string, string> = {}, data?: unknown) {
    super(message);
    this.name = 'AuthorApiError';
    this.status = status;
    this.fields = fields;
    this.data = data;
  }
}

