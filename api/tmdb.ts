import { createServerlessTmdbHandler } from '../src/proxy/serverless-handler';

const handler = createServerlessTmdbHandler({ runtimeEnv: process.env });

export default handler;
