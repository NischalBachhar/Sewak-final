import type { Data } from './types.ts';

// No medical booking path is enabled until credential and availability policy
// exists. This guard also covers old/custom services, not only seeded IDs.
export const medicalService = (data: Data) => data.requiresProfessionalCredentials === true || /nurs|wound|medication|licensed|medical/i.test(String(data.label || data.serviceName || '').replace(/nonmedical/ig, ''));
export const nonMedicalSql = (alias: string) => `COALESCE(json_extract(${alias}.extra_json,'$.requiresProfessionalCredentials'),0)=0 AND lower(COALESCE(${alias}.label,${alias}.service_name,'')) NOT LIKE '%nurs%' AND lower(COALESCE(${alias}.label,${alias}.service_name,'')) NOT LIKE '%wound%' AND lower(COALESCE(${alias}.label,${alias}.service_name,'')) NOT LIKE '%medication%' AND lower(COALESCE(${alias}.label,${alias}.service_name,'')) NOT LIKE '%licensed%' AND replace(lower(COALESCE(${alias}.label,${alias}.service_name,'')),'nonmedical','') NOT LIKE '%medical%'`;
