import { authKeycloak } from "@/middleware/auth";
import { fetchGroups } from "@/service/groups";
import { fetchReports } from "@/service/reports";
import { AuthenticatedRequest, ReqReport, ResError, ResGroupStatus, ResReport } from "@/types/common";
import { decryptSecret } from "@/utils/crypto";
import { FastifyInstance, FastifyPluginOptions, FastifyReply } from "fastify";

export default async function groupRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {
  fastify.post<{
    Body: ReqReport;
    Reply: ResGroupStatus[] | ResError;
  }>('/status/groups', {
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
          },
          report: {
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
            required: ["name", "status"],
            properties: {
              name: { type: "string" },
              status: { type: "string" }
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
  }, async (request: AuthenticatedRequest, reply: FastifyReply): Promise<ResGroupStatus[] | ResError> => {
    const { api, secret, report } = request.body as ReqReport;

    try {
      const groups = await fetchGroups(api, decryptSecret(secret), report);
      return groups; 
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