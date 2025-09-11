import Fastify, { FastifyBaseLogger, FastifyInstance, FastifyTypeProvider, RawServerDefault } from 'fastify';
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import cors from "@fastify/cors";

import corsPlugin from '@/plugins/cors';

// Import routes
import healthRoutes from '@/routes/health';
import profileRoutes from '@/routes/profile';
import reportRoutes from '@/routes/reports';
import groupRoutes from './routes/groups';
import pageRoutes from './routes/pages';
import postgres from './plugins/postgres';
import { IncomingMessage, ServerResponse } from 'http';
import encryptRoutes from './routes/encrypt';
//import cors from '@/plugins/cors';

export const createApp = async (): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty'
      }
    }
  });

  await app.register(corsPlugin)

  await app.register(postgres);

  await app.register(swagger, {
    openapi: {
      info: {
        title: "ARGO Status Pages API",
        description: "API to create/edit status pages for argo-web-api results",
        version: "1.0.0"
      }
    }
  });


  await app.register(swaggerUI, {
    routePrefix: "/docs",
  });



  // Register routes with v1 prefix
  await app.register(healthRoutes, { prefix: '/v1' });
  await app.register(profileRoutes, { prefix: '/v1' });
  await app.register(reportRoutes, { prefix: '/v1' });
  await app.register(groupRoutes, { prefix: '/v1' });
  await app.register(pageRoutes, { prefix: '/v1' });
  await app.register(encryptRoutes, { prefix: '/v1' });



  app.setErrorHandler((error, request, reply) => {
    app.log.error(error, 'Fastify error');

    if (error.validation) {
      reply.code(400).send({
        error: 'Validation Error',
        message: error.message,
        details: error.validation
      });
      return;
    }

    reply.code(500).send({
      error: 'Internal Server Error',
      message: error.message
    });
  });

  return app;
};

