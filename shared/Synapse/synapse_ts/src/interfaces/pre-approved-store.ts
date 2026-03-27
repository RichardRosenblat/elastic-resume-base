/** A pre-approved user document. */
export interface PreApprovedDocument {
  email: string;
  role: string;
}

/** Data required to add a pre-approved user. */
export interface CreatePreApprovedData {
  email: string;
  role: string;
}

/** Data for updating a pre-approved user. */
export interface UpdatePreApprovedData {
  role?: string;
}

/** Filters to apply when listing pre-approved users. */
export interface PreApprovedFilters {
  role?: string;
}

/** Abstract interface for pre-approved user persistence operations. */
export interface IPreApprovedStore {
  add(data: CreatePreApprovedData): Promise<PreApprovedDocument>;
  getByEmail(email: string): Promise<PreApprovedDocument | null>;
  update(email: string, data: UpdatePreApprovedData): Promise<PreApprovedDocument>;
  delete(email: string): Promise<void>;
  list(filters?: PreApprovedFilters): Promise<PreApprovedDocument[]>;
}
