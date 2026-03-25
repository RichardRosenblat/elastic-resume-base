import type { IUserDocumentStore, UserDocument, CreateUserDocumentData, UpdateUserDocumentData, UserDocumentFilters, ListUserDocumentsResult } from '../interfaces/user-document-store.js';
/**
 * Concrete {@link IUserDocumentStore} implementation backed by Firestore.
 */
export declare class FirestoreUserDocumentStore implements IUserDocumentStore {
    private readonly _collectionName;
    constructor(collectionName: string);
    private get _collection();
    createUser(data: CreateUserDocumentData): Promise<UserDocument>;
    getUserByUid(uid: string): Promise<UserDocument>;
    getUserByEmail(email: string): Promise<UserDocument | null>;
    updateUser(uid: string, data: UpdateUserDocumentData): Promise<UserDocument>;
    deleteUser(uid: string): Promise<void>;
    listUsers(maxResults?: number, pageToken?: string, filters?: UserDocumentFilters): Promise<ListUserDocumentsResult>;
}
//# sourceMappingURL=firestore-user-document-store.d.ts.map