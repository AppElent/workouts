import type { Doc } from '../_generated/dataModel'

export function toPublicHostedTemplate(
  template: Doc<'hostedWorkouts'>['template'],
) {
  return {
    strengthBlocks: template.strengthBlocks.map((block) => {
      const { exerciseId: _exerciseId, ...publicBlock } = block
      return publicBlock
    }),
    wodBlocks: template.wodBlocks.map((block) => {
      const { wodId: _wodId, ...publicBlock } = block
      return publicBlock
    }),
  }
}

export function toHostedSessionDto(hosted: Doc<'hostedWorkouts'>) {
  return {
    title: hosted.title,
    notes: hosted.notes,
    scheduledAt: hosted.scheduledAt,
    status: hosted.status,
    template: {
      strengthBlocks: hosted.template.strengthBlocks,
      wodBlocks: toPublicHostedTemplate(hosted.template).wodBlocks,
    },
  }
}
