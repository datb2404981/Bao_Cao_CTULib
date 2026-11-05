/**
 * apps/frontend/src/types/faculty.ts
 * Type definitions for Faculty module matching backend schema and API contracts.
 * Strictly compliant with "erasableSyntaxOnly: true".
 */

export interface Faculty {
  _id: string;
  facultyName: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateFacultyPayload {
  facultyName: string;
  description?: string;
}

export interface UpdateFacultyPayload {
  facultyName: string;
  description?: string;
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

export class FacultyApiError extends Error {
  status: number;
  fields: Record<string, string>;
  data?: unknown;

  constructor(message: string, status: number, fields: Record<string, string> = {}, data?: unknown) {
    super(message);
    this.name = 'FacultyApiError';
    this.status = status;
    this.fields = fields;
    this.data = data;
  }
}

