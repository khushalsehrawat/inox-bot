export type WebsiteAdminConfig = { email: string; passwordHash: string; secret: string };
export const websiteAdminCookie: string;
export const websiteAdminLifetime: number;
export function websiteAdminConfig(env?: NodeJS.ProcessEnv): WebsiteAdminConfig | null;
export function hashWebsiteAdminPassword(password: string): Promise<string>;
export function verifyWebsiteAdminPassword(config: WebsiteAdminConfig, email: string, password: string): Promise<boolean>;
export function createWebsiteAdminSession(config: WebsiteAdminConfig, now?: number): string;
export function verifyWebsiteAdminSession(token: string | undefined, config: WebsiteAdminConfig, now?: number): boolean;
