export type SCIMSchema = {
  id: string;
  name: string;
  description: string;
  attributes: SCIMAttribute[];
};

export type SCIMAttribute = {
  name: string;
  type: "string" | "boolean" | "decimal" | "integer" | "dateTime" | "reference" | "complex";
  multiValued?: boolean;
  description?: string;
  required?: boolean;
  canonicalValues?: string[];
  caseExact?: boolean;
  mutability?: "readWrite" | "readOnly" | "writeOnly" | "immutable";
  returned?: "always" | "never" | "default" | "request";
  uniqueness?: "none" | "server" | "global";
  subAttributes?: SCIMAttribute[];
};

export type SCIMListResponse = {
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources: SCIMResource[];
  schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"];
};

export type SCIMErrorResponse = {
  schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"];
  status: string;
  detail?: string;
  scimType?: string;
};

export type SCIMResource = {
  id: string;
  externalId?: string;
  meta: SCIMResourceMeta;
  schemas: string[];
};

export type SCIMResourceMeta = {
  resourceType: "User" | "Group";
  created: string;
  lastModified: string;
  version: string;
  location?: string;
};

export type SCIMUser = SCIMResource & {
  schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"];
  userName: string;
  name?: SCIMUserName;
  displayName?: string;
  emails?: SCIMEmail[];
  phoneNumbers?: SCIMPhoneNumber[];
  active: boolean;
  roles?: SCIMUserRole[];
  groups?: SCIMUserGroup[];
  "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User"?: SCIMEnterpriseUser;
};

export type SCIMUserName = {
  formatted?: string;
  familyName?: string;
  givenName?: string;
  middleName?: string;
  honorificPrefix?: string;
  honorificSuffix?: string;
};

export type SCIMEmail = {
  type?: "work" | "home" | "other";
  value: string;
  primary?: boolean;
};

export type SCIMPhoneNumber = {
  type?: "work" | "mobile" | "home" | "other";
  value: string;
};

export type SCIMUserRole = {
  value: string;
  display?: string;
  type?: string;
  primary?: boolean;
};

export type SCIMUserGroup = {
  value: string;
  display?: string;
  type?: string;
};

export type SCIMGroup = SCIMResource & {
  schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"];
  displayName: string;
  members?: SCIMGroupMember[];
};

export type SCIMGroupMember = {
  value: string;
  display?: string;
  type?: "User" | "Group";
};

export type SCIMEnterpriseUser = {
  employeeNumber?: string;
  costCenter?: string;
  organization?: string;
  division?: string;
  department?: string;
  manager?: {
    value?: string;
    displayName?: string;
  };
};

export type SCIMCreateUserRequest = {
  schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"];
  externalId?: string;
  userName: string;
  name?: SCIMUserName;
  displayName?: string;
  emails?: SCIMEmail[];
  active?: boolean;
  roles?: SCIMUserRole[];
  "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User"?: SCIMEnterpriseUser;
};

export type SCIMCreateGroupRequest = {
  schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"];
  externalId?: string;
  displayName: string;
  members?: SCIMGroupMember[];
};

export type SCIMPatchRequest = {
  schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"];
  Operations: SCIMPatchOperation[];
};

export type SCIMPatchOperation = {
  op: "add" | "remove" | "replace";
  path?: string;
  value: unknown;
};

export const SCIM_USER_SCHEMA_URI = "urn:ietf:params:scim:schemas:core:2.0:User";
export const SCIM_GROUP_SCHEMA_URI = "urn:ietf:params:scim:schemas:core:2.0:Group";
export const SCIM_ENTERPRISE_USER_SCHEMA_URI = "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User";
export const SCIM_LIST_RESPONSE_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:ListResponse";
export const SCIM_ERROR_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:Error";
export const SCIM_PATCH_OP_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:PatchOp";
