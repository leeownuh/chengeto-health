import mongoose, { Schema } from 'mongoose';
import {
  buildDefaultTransitionCheckpoints,
  buildTransitionTaskPayload,
  CARE_TRANSITION_CHECKPOINT_KEYS,
  CARE_TRANSITION_OWNER_ROLES,
  CARE_TRANSITION_STATUSES,
  CARE_TRANSITION_TASK_STATUSES,
  CARE_TRANSITION_TYPES
} from '../utils/careTransition.js';

const followUpTaskSchema = new Schema(
  {
    title: {
      type: String,
      required: true
    },
    description: String,
    ownerRole: {
      type: String,
      enum: CARE_TRANSITION_OWNER_ROLES,
      default: 'caregiver'
    },
    dueDate: Date,
    status: {
      type: String,
      enum: CARE_TRANSITION_TASK_STATUSES,
      default: 'pending'
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    notes: String,
    completedAt: Date,
    completedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    required: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

const checkpointSchema = new Schema(
  {
    dueDate: Date,
    status: {
      type: String,
      enum: CARE_TRANSITION_TASK_STATUSES,
      default: 'pending'
    },
    completedAt: Date,
    completedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: String
  },
  { _id: false }
);

const medicationChangeSchema = new Schema(
  {
    name: String,
    dosage: String,
    changeType: {
      type: String,
      enum: ['started', 'stopped', 'changed', 'continued'],
      default: 'continued'
    },
    instructions: String
  },
  { _id: false }
);

const careTransitionSchema = new Schema(
  {
    transitionId: {
      type: String,
      unique: true
    },
    patient: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    assignedCaregiver: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    assignedCHW: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    assignedClinician: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: CARE_TRANSITION_STATUSES,
      default: 'active'
    },
    transitionType: {
      type: String,
      enum: CARE_TRANSITION_TYPES,
      default: 'hospital_discharge'
    },
    dischargeDate: {
      type: Date,
      required: true
    },
    dischargeReason: String,
    dischargeFacility: String,
    diagnosisSummary: String,
    medicationChanges: {
      type: [medicationChangeSchema],
      default: []
    },
    redFlags: {
      type: [String],
      default: []
    },
    followUpTasks: {
      type: [followUpTaskSchema],
      default: []
    },
    checkpoints: {
      day7: checkpointSchema,
      day14: checkpointSchema,
      day30: checkpointSchema
    },
    nextReviewDate: Date,
    lastContactAt: Date,
    outcomeSummary: String,
    completedAt: Date
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

careTransitionSchema.index({ patient: 1, status: 1 });
careTransitionSchema.index({ dischargeDate: -1 });
careTransitionSchema.index({ assignedClinician: 1, status: 1 });
careTransitionSchema.index({ assignedCaregiver: 1, status: 1 });
careTransitionSchema.index({ assignedCHW: 1, status: 1 });

careTransitionSchema.statics.generateTransitionId = async function generateTransitionId() {
  const count = await this.countDocuments();
  const year = new Date().getFullYear();
  return `TRN-${year}-${String(count + 1).padStart(5, '0')}`;
};

careTransitionSchema.pre('validate', async function prepareTransition(next) {
  try {
    if (!this.transitionId) {
      this.transitionId = await this.constructor.generateTransitionId();
    }

    this.followUpTasks = buildTransitionTaskPayload(this.followUpTasks, this.dischargeDate);
    this.checkpoints = buildDefaultTransitionCheckpoints(this.dischargeDate, this.checkpoints);

    if (this.status === 'completed' && !this.completedAt) {
      this.completedAt = new Date();
    }

    if (this.status !== 'completed') {
      this.completedAt = undefined;
    }

    next();
  } catch (error) {
    next(error);
  }
});

careTransitionSchema.methods.completeTask = async function completeTask(taskId, userId, notes = '') {
  const task = this.followUpTasks.id(taskId);
  if (!task) {
    return null;
  }

  task.status = 'completed';
  task.completedAt = new Date();
  task.completedBy = userId;
  if (notes) {
    task.notes = notes;
  }
  this.lastContactAt = new Date();
  await this.save();
  return task;
};

careTransitionSchema.methods.completeCheckpoint = async function completeCheckpoint(checkpointKey, userId, notes = '') {
  if (!CARE_TRANSITION_CHECKPOINT_KEYS.includes(checkpointKey)) {
    return null;
  }

  const checkpoint = this.checkpoints?.[checkpointKey];
  if (!checkpoint) {
    return null;
  }

  checkpoint.status = 'completed';
  checkpoint.completedAt = new Date();
  checkpoint.completedBy = userId;
  checkpoint.notes = notes || checkpoint.notes;
  this.lastContactAt = new Date();
  await this.save();
  return checkpoint;
};

const CareTransition = mongoose.models.CareTransition || mongoose.model('CareTransition', careTransitionSchema);

export default CareTransition;
