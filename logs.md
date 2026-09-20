node:  [
  {
    id: 'triggerNode-1789918170255',
    data: { key: 'trigger.schedule', name: 'Schedule', config: [Object] },
    type: 'triggerNode',
    measured: { width: 192, height: 76 },
    position: { x: 209, y: 107 },
    selected: true
  },
  {
    id: 'actionNode-1789918171087',
    data: {
      key: 'google.calendar.get_events',
      name: 'Google Calendar',
      config: {}
    },
    type: 'actionNode',
    measured: { width: 192, height: 77 },
    position: { x: 281.5, y: 288.5 }
  },
  {
    id: 'actionNode-1789918172988',
    data: { key: 'logic.if', name: 'If', config: {} },
    type: 'actionNode',
    measured: { width: 192, height: 77 },
    position: { x: 393.4776453697213, y: 558.9719854592527 }
  },
  {
    id: 'actionNode-1789918174046',
    data: { key: 'data.format_text', name: 'Format Text', config: {} },
    type: 'actionNode',
    measured: { width: 192, height: 77 },
    position: { x: 409.5594223396798, y: 779.5220696186834 }
  }
]
edges [
  {
    id: 'xy-edge__triggerNode-1789918170255-actionNode-1789918171087',
    source: 'triggerNode-1789918170255',
    target: 'actionNode-1789918171087'
  },
  {
    id: 'xy-edge__actionNode-1789918171087-actionNode-1789918172988',
    source: 'actionNode-1789918171087',
    target: 'actionNode-1789918172988'
  },
  {
    id: 'xy-edge__actionNode-1789918172988-actionNode-1789918174046',
    source: 'actionNode-1789918172988',
    target: 'actionNode-1789918174046'
  }
]
[Nest] 12536  - 09/20/2026, 10:29:51 PM   ERROR [ExceptionsHandler] PrismaClientKnownRequestError:        
Invalid `this.prisma.workflow.update()` invocation in
C:\project\tlcn\workflow-automation\monolith-backend\dist\apps\api\main.js:3337:36

  3334     return created.id;
  3335 }
  3336 async update(workflow) {
→ 3337     await this.prisma.workflow.update(
Inconsistent column data: Error creating UUID, invalid length: expected length 32 for simple format, found 0
    at $n.handleRequestError (C:\project\tlcn\workflow-automation\monolith-backend\node_modules\@prisma\client\runtime\library.js:121:7315)
    at $n.handleAndLogRequestError (C:\project\tlcn\workflow-automation\monolith-backend\node_modules\@prisma\client\runtime\library.js:121:6623)
    at $n.request (C:\project\tlcn\workflow-automation\monolith-backend\node_modules\@prisma\client\runtime\library.js:121:6307)
    at async l (C:\project\tlcn\workflow-automation\monolith-backend\node_modules\@prisma\client\runtime\library.js:130:9633)
    at async PrismaWorkflowRepository.update (C:\project\tlcn\workflow-automation\monolith-backend\dist\apps\api\main.js:3337:9)
    at async PublishWorkflowHandler.execute (C:\project\tlcn\workflow-automation\monolith-backend\dist\apps\api\main.js:2752:9)
    at async WorkflowsController.publishWorkflow (C:\project\tlcn\workflow-automation\monolith-backend\dis    at $n.request (C:\project\tlcn\workflow-automation\monolith-backend\node_modules\@prisma\client\runtime\library.js:121:6307)
    at async l (C:\project\tlcn\workflow-automation\monolith-backend\node_modules\@prisma\client\runtime\library.js:130:9633)
    at async PrismaWorkflowRepository.update (C:\project\tlcn\workflow-automation\monolith-backend\dist\apps\api\main.js:3337:9)
    at async PublishWorkflowHandler.execute (C:\project\tlcn\workflow-automation\monolith-backend\dist\apps\api\main.js:2752:9)
    at async WorkflowsController.publishWorkflow (C:\project\tlcn\workflow-automation\monolith-backend\dis    at async PrismaWorkflowRepository.update (C:\project\tlcn\workflow-automation\monolith-backend\dist\apps\api\main.js:3337:9)
    at async PublishWorkflowHandler.execute (C:\project\tlcn\workflow-automation\monolith-backend\dist\apps\api\main.js:2752:9)
    at async WorkflowsController.publishWorkflow (C:\project\tlcn\workflow-automation\monolith-backend\dis    at async PublishWorkflowHandler.execute (C:\project\tlcn\workflow-automation\monolith-backend\dist\apps\api\main.js:2752:9)
    at async WorkflowsController.publishWorkflow (C:\project\tlcn\workflow-automation\monolith-backend\diss\api\main.js:2752:9)
    at async WorkflowsController.publishWorkflow (C:\project\tlcn\workflow-automation\monolith-backend\dis    at async WorkflowsController.publishWorkflow (C:\project\tlcn\workflow-automation\monolith-backend\dist\apps\api\main.js:3570:24)
    at async C:\project\tlcn\workflow-automation\monolith-backend\node_modules\@nestjs\core\router\router-execution-context.js:47:62
    at async C:\project\tlcn\workflow-automation\monolith-backend\node_modules\@nestjs\core\router\router-proxy.js:9:17 {
  code: 'P2023',
  clientVersion: '5.22.0',
  meta: {
    modelName: 'Workflow',
    message: 'Error creating UUID, invalid length: expected length 32 for simple format, found 0'
  }
}
