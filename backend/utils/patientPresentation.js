import Patient from '../models/Patient.js';

export function materializePatient(patient) {
  if (!patient) {
    return patient;
  }

  if (typeof patient.toObject === 'function') {
    return patient.toObject({ getters: true, virtuals: true });
  }

  return Patient.hydrate(patient).toObject({ getters: true, virtuals: true });
}

export function materializePatients(patients = []) {
  return patients.map((patient) => materializePatient(patient));
}
