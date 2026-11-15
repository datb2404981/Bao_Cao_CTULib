export interface Publisher {
  _id: string;
  publisherCode?: string;
  publisherName: string;
  address?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePublisherPayload {
  publisherCode?: string;
  publisherName: string;
  address?: string;
}

export interface UpdatePublisherPayload {
  publisherCode?: string;
  publisherName?: string;
  address?: string;
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

export class PublisherApiError extends Error {
  status: number;
  fields: Record<string, string>;
  data?: unknown;

  constructor(message: string, status: number, fields: Record<string, string> = {}, data?: unknown) {
    super(message);
    this.name = 'PublisherApiError';
    this.status = status;
    this.fields = fields;
    this.data = data;
    Object.setPrototypeOf(this, PublisherApiError.prototype);
  }
}
