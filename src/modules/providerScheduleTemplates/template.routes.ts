// src/modules/providerScheduleTemplates/template.routes.ts

import { Router } from 'express';
import { authenticate } from '@common/middleware/auth.js';
import { validate } from '@common/middleware/validate.js';
import * as TemplateController from './template.controller.js';
import { createTemplateSchema, updateTemplateSchema } from './template.validation.js';

const router = Router();

// CRUD
router.post('/', authenticate, validate(createTemplateSchema), TemplateController.createTemplate);
router.get('/', authenticate, TemplateController.listTemplates);
router.patch('/:id', authenticate, validate(updateTemplateSchema), TemplateController.updateTemplate);
router.delete('/:id', authenticate, TemplateController.deleteTemplate);

export default router;
