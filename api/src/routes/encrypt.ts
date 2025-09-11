import fastify from 'fastify';
import { encryptSecret } from '@/utils/crypto'; 
import { FastifyInstance, FastifyPluginOptions } from 'fastify';

export default async function encryptRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {
  
  // Encrypt secret
  fastify.post<{
    Body: { secret: string };
    Reply: { secret: string } | { error: string };
  }>('/encrypt', {
    schema: {
      body: {
        type: 'object',
        required: ['secret'],
        properties: {
          secret: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            secret: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { secret } = request.body;
      
      if (!secret || secret.trim() === '') {
        reply.code(400);
        return {
          error: 'Secret cannot be empty'
        };
      }
      
      const encryptedSecret = encryptSecret(secret);
      
      return {
        secret: encryptedSecret
      };
      
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return {
        error: 'Failed to encrypt secret'
      };
    }
  });

}