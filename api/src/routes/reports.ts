import { authKeycloak } from "@/middleware/auth";
import { fetchReports } from "@/service/reports";
import { AuthenticatedRequest, ReqSimple, ResError, ResReport } from "@/types/common";
import { decryptSecret } from "@/utils/crypto";
import { FastifyInstance, FastifyPluginOptions, FastifyReply } from "fastify";

export default async function reportRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {
  fastify.post<{
    Body: ReqSimple;
    Reply: ResReport[] | ResError;
  }>('/reports', {
    preHandler: [authKeycloak],
    schema: {
      body: {
        type: 'object',
        required: ['api', 'secret'],
        properties: {
          api: {
            type: 'string',
            minLength: 1
          },
          secret: {
            type: 'string',
            minLength: 1
          }
        },
        additionalProperties: false
      },
      response: {
        200: {
          type: "array",
          items: {
            type: "object",
            required: ["name", "description"],
            properties: {
              name: { type: "string" },
              description: { type: "string" }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            code: { type: 'number' },
            message: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            code: {type: 'number'},
            message: {type: 'string'}
          }
        }
      }
    }
  }, async (request: AuthenticatedRequest, reply: FastifyReply): Promise<ResReport[] | ResError> => {
    const { api, secret } = request.body as ReqSimple;

    try {
      const reports = await fetchReports(api, decryptSecret(secret));
      console.log(reports)
      return reports; 
    } catch (err) {
      console.log("oups an error happened!")
      console.error(err);
      reply.code(500);
      return {
        code: 500,
        message: JSON.stringify(err)
      }
    }
  });
}