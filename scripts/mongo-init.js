// CHENGETO Health MongoDB Initialization Script
// This script runs when the MongoDB container is first created

db = db.getSiblingDB('chengeto_health');

// Create application user
db.createUser({
  user: 'chengeto_app',
  pwd: 'chengeto_app_password_2024',
  roles: [
    { role: 'readWrite', db: 'chengeto_health' },
    { role: 'dbAdmin', db: 'chengeto_health' }
  ]
});

// Create collections with validation
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'password', 'role'],
      properties: {
        email: { bsonType: 'string' },
        password: { bsonType: 'string' },
        role: { bsonType: 'string' },
        firstName: { bsonType: 'string' },
        lastName: { bsonType: 'string' },
        phone: { bsonType: 'string' },
        verified: { bsonType: 'bool' },
        mfaEnabled: { bsonType: 'bool' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('patients', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['patientId', 'firstName', 'lastName', 'dateOfBirth'],
      properties: {
        patientId: { bsonType: 'string' },
        firstName: { bsonType: 'string' },
        lastName: { bsonType: 'string' },
        dateOfBirth: { bsonType: 'date' },
        gender: { bsonType: 'string' },
        bloodType: { bsonType: 'string' },
        allergies: { bsonType: 'array' },
        medications: { bsonType: 'array' },
        diagnoses: { bsonType: 'array' },
        emergencyContact: { bsonType: 'object' },
        vitalThresholds: { bsonType: 'object' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('alerts', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['patient', 'type', 'severity', 'status'],
      properties: {
        patient: { bsonType: 'objectId' },
        type: { bsonType: 'string' },
        severity: { bsonType: 'string' },
        status: { bsonType: 'string' },
        message: { bsonType: 'string' },
        vitals: { bsonType: 'object' },
        escalationLevel: { bsonType: 'int' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('checkins', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['patient', 'caregiver', 'verificationMethod'],
      properties: {
        patient: { bsonType: 'objectId' },
        caregiver: { bsonType: 'objectId' },
        verificationMethod: { bsonType: 'string' },
        location: { bsonType: 'object' },
        vitals: { bsonType: 'object' },
        wellnessAssessment: { bsonType: 'object' },
        blockchainHash: { bsonType: 'string' },
        createdAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('iottelemetry', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['deviceId', 'patient', 'type'],
      properties: {
        deviceId: { bsonType: 'string' },
        patient: { bsonType: 'objectId' },
        type: { bsonType: 'string' },
        data: { bsonType: 'object' },
        timestamp: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('careschedules', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['patient', 'title', 'scheduledFor', 'assignedTo'],
      properties: {
        patient: { bsonType: 'objectId' },
        title: { bsonType: 'string' },
        description: { bsonType: 'string' },
        scheduledFor: { bsonType: 'date' },
        assignedTo: { bsonType: 'objectId' },
        status: { bsonType: 'string' },
        recurrence: { bsonType: 'object' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('auditlogs', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['action', 'actor', 'timestamp'],
      properties: {
        action: { bsonType: 'string' },
        actor: { bsonType: 'objectId' },
        resource: { bsonType: 'string' },
        resourceId: { bsonType: 'string' },
        details: { bsonType: 'object' },
        ipAddress: { bsonType: 'string' },
        userAgent: { bsonType: 'string' },
        timestamp: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('iotdevices', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['deviceId', 'type', 'patient'],
      properties: {
        deviceId: { bsonType: 'string' },
        type: { bsonType: 'string' },
        patient: { bsonType: 'objectId' },
        name: { bsonType: 'string' },
        status: { bsonType: 'string' },
        batteryLevel: { bsonType: 'int' },
        lastSeen: { bsonType: 'date' },
        configuration: { bsonType: 'object' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' }
      }
    }
  }
});

// Create indexes for better query performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ role: 1 });
db.users.createIndex({ createdAt: 1 });

db.patients.createIndex({ patientId: 1 }, { unique: true });
db.patients.createIndex({ lastName: 1, firstName: 1 });
db.patients.createIndex({ 'location.coordinates': '2dsphere' });

db.alerts.createIndex({ patient: 1, status: 1 });
db.alerts.createIndex({ severity: 1, status: 1 });
db.alerts.createIndex({ createdAt: -1 });
db.alerts.createIndex({ escalationLevel: 1 });

db.checkins.createIndex({ patient: 1, createdAt: -1 });
db.checkins.createIndex({ caregiver: 1, createdAt: -1 });
db.checkins.createIndex({ verificationMethod: 1 });
db.checkins.createIndex({ blockchainHash: 1 }, { sparse: true });

db.iottelemetry.createIndex({ deviceId: 1, timestamp: -1 });
db.iottelemetry.createIndex({ patient: 1, timestamp: -1 });
db.iottelemetry.createIndex({ type: 1 });
db.iottelemetry.createIndex({ timestamp: 1 }, { expireAfterSeconds: 7776000 }); // TTL: 90 days

db.careschedules.createIndex({ patient: 1, scheduledFor: 1 });
db.careschedules.createIndex({ assignedTo: 1, status: 1 });
db.careschedules.createIndex({ status: 1, scheduledFor: 1 });

db.auditlogs.createIndex({ action: 1, timestamp: -1 });
db.auditlogs.createIndex({ actor: 1, timestamp: -1 });
db.auditlogs.createIndex({ resource: 1, resourceId: 1 });
db.auditlogs.createIndex({ timestamp: 1 }, { expireAfterSeconds: 31536000 }); // TTL: 1 year

db.iotdevices.createIndex({ deviceId: 1 }, { unique: true });
db.iotdevices.createIndex({ patient: 1 });
db.iotdevices.createIndex({ status: 1 });

print('CHENGETO Health database initialized successfully!');
print('Collections created: users, patients, alerts, checkins, iottelemetry, careschedules, auditlogs, iotdevices');
print('Indexes created for optimal query performance');