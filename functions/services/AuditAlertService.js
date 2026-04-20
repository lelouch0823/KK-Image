import { NotificationRepository } from '../repositories/NotificationRepository.js';

export class AuditAlertService {
  constructor(db) {
    this.notificationRepo = new NotificationRepository(db);
  }

  async createAlert({ alertType, severity = 'high', summary, metadata = null }) {
    return this.notificationRepo.create({
      type: 'audit-alert',
      title: `Audit Alert: ${alertType}`,
      content: summary || '',
      receiver: 'admin',
      metadata: {
        alertType,
        severity,
        ...(metadata || {}),
      },
    });
  }
}
