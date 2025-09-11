import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import postgres from '@fastify/postgres'; // ES6 import

const postgresPlugin: FastifyPluginAsync = async (fastify) => {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  await fastify.register(postgres, { // Use the imported module
    connectionString
  });
};

export default fp(postgresPlugin, {
  name: 'postgres'
});