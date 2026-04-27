import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.join(__dirname, '../../data');
const configPath = path.join(dataDir, 'config.json');

export interface Config {
	queueChannelId: string | null;
}

function ensureDir(): void {
	if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

export function readConfig(): Config {
	ensureDir();
	try {
		return JSON.parse(fs.readFileSync(configPath, 'utf8')) as Config;
	} catch {
		return { queueChannelId: null };
	}
}

export function writeConfig(config: Config): void {
	ensureDir();
	fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}
