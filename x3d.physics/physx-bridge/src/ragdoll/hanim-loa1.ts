// H-Anim 2.0 level of articulation 1, from the X3D 4.0 XSD's appinfo (tools/hanim-loa.py -> src/ragdoll/hanim-all.json): joint, nearest
// LOA-1 parent, default centre (metres, humanoid frame, a 1.75 m figure), and the segment the joint carries. Generated; do not edit.
export interface HAnimRow { joint: string; parent: string | null; center: [number, number, number]; segment: string }
export const LOA1: HAnimRow[] = [
  { joint: 'humanoid_root', parent: null, center: [0.0, 0.824, 0.0277], segment: 'sacrum' },
  { joint: 'sacroiliac', parent: 'humanoid_root', center: [0.0, 0.9149, 0.0016], segment: 'pelvis' },
  { joint: 'l_hip', parent: 'sacroiliac', center: [0.0961, 0.9124, -0.0001], segment: 'l_thigh' },
  { joint: 'l_knee', parent: 'l_hip', center: [0.104, 0.4867, 0.0308], segment: 'l_calf' },
  { joint: 'l_talocrural', parent: 'l_knee', center: [0.1101, 0.0656, -0.0736], segment: 'l_talus' },
  { joint: 'l_metatarsophalangeal_2', parent: 'l_talocrural', center: [0.1086, 0.0001, 0.0368], segment: 'l_tarsal_proximal_phalanx_2' },
  { joint: 'r_hip', parent: 'sacroiliac', center: [-0.095, 0.9171, 0.0029], segment: 'r_thigh' },
  { joint: 'r_knee', parent: 'r_hip', center: [-0.0867, 0.4913, 0.0318], segment: 'r_calf' },
  { joint: 'r_talocrural', parent: 'r_knee', center: [-0.0801, 0.0712, -0.0766], segment: 'r_talus' },
  { joint: 'r_metatarsophalangeal_2', parent: 'r_talocrural', center: [-0.0801, 0.0, 0.0368], segment: 'r_tarsal_proximal_phalanx_2' },
  { joint: 'vl5', parent: 'humanoid_root', center: [0.0028, 1.0568, -0.0776], segment: 'l5' },
  { joint: 'skullbase', parent: 'vl5', center: [0.0044, 1.6209, 0.0236], segment: 'skull' },
  { joint: 'l_shoulder', parent: 'vl5', center: [0.2029, 1.4376, -0.0387], segment: 'l_upperarm' },
  { joint: 'l_elbow', parent: 'l_shoulder', center: [0.2014, 1.1357, -0.0682], segment: 'l_forearm' },
  { joint: 'l_radiocarpal', parent: 'l_elbow', center: [0.1984, 0.8663, -0.0583], segment: 'l_carpal' },
  { joint: 'r_shoulder', parent: 'vl5', center: [-0.1907, 1.4407, -0.0325], segment: 'r_upperarm' },
  { joint: 'r_elbow', parent: 'r_shoulder', center: [-0.1949, 1.1388, -0.062], segment: 'r_forearm' },
  { joint: 'r_radiocarpal', parent: 'r_elbow', center: [-0.1959, 0.8694, -0.0521], segment: 'r_carpal' },
];
