// This standalone bot preview is enabled on Vercel unless explicitly switched off.
export const askInoxEnabled = () => (process.env.ASK_INOX_ENABLED ?? (process.env.VERCEL === "1" ? "true" : "false")) === "true";
