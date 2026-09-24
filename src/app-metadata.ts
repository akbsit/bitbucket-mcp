import packageMetadata from '../package.json';

export const SERVER_NAME = packageMetadata.name;
export const SERVER_VERSION = packageMetadata.version;
export const USER_AGENT = `${SERVER_NAME}/${SERVER_VERSION}`;
