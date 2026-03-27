/** A user document record. */
export interface UserDocument {
    uid: string;
    email: string;
    role: string;
    enable: boolean;
}
/** Data required to create a user document. */
export interface CreateUserDocumentData {
    uid: string;
    email: string;
    role: string;
    enable: boolean;
}
/** Data for updating a user document. All fields are optional. */
export interface UpdateUserDocumentData {
    email?: string;
    role?: string;
    enable?: boolean;
}
/** Filters to apply when listing user documents. */
export interface UserDocumentFilters {
    email?: string;
    role?: string;
    enable?: boolean;
}
/** Paginated list result for user documents. */
export interface ListUserDocumentsResult {
    users: UserDocument[];
    pageToken?: string;
}
/** Abstract interface for user document persistence operations. */
export interface IUserDocumentStore {
    createUser(data: CreateUserDocumentData): Promise<UserDocument>;
    getUserByUid(uid: string): Promise<UserDocument>;
    getUserByEmail(email: string): Promise<UserDocument | null>;
    updateUser(uid: string, data: UpdateUserDocumentData): Promise<UserDocument>;
    deleteUser(uid: string): Promise<void>;
    listUsers(maxResults?: number, pageToken?: string, filters?: UserDocumentFilters): Promise<ListUserDocumentsResult>;
}
//# sourceMappingURL=user-document-store.d.ts.map