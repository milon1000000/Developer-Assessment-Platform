export interface ICreateAuditLogPayload {
	userId?: string | null;
	action: string;
	entity: string;
	entityId?: string | null;
	metadata?: Record<string, any> | null;
}

export interface IAuditLogFilterableFields {
	searchTerm?: string;
	action?: string;
	entity?: string;
	userId?: string;
	startDate?: string;
	endDate?: string;
}
