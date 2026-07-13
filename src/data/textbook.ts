// Huang, Y. H. (2004). Pavement Analysis and Design (2nd ed.).
// One entry per chapter/appendix; drives the textbook index and reader pages.

export interface TextbookEntry {
  id: string;      // 'ch01' | 'appendix-a'
  kind: 'chapter' | 'appendix';
  num: string;     // '1' | 'A'
  title: string;
  desc: string;
  pdf: string;     // filename under public/textbook/
  relatedHws: { id: string; label: string }[];
}

export const textbook: TextbookEntry[] = [
  {
    id: 'ch01', kind: 'chapter', num: '1', title: 'Introduction', pdf: 'ch01.pdf',
    desc: 'Historical development of pavement design, flexible and rigid pavement types, and the factors a design method must capture.',
    relatedHws: [{ id: 'hw1', label: 'HW1' }],
  },
  {
    id: 'ch02', kind: 'chapter', num: '2', title: 'Stresses and Strains in Flexible Pavements', pdf: 'ch02.pdf',
    desc: 'Boussinesq theory for a homogeneous mass, Burmister layered systems, and viscoelastic solutions — the analytical backbone of flexible pavements.',
    relatedHws: [{ id: 'hw3', label: 'HW3' }, { id: 'hw4', label: 'HW4' }],
  },
  {
    id: 'ch03', kind: 'chapter', num: '3', title: 'KENLAYER Computer Program', pdf: 'ch03.pdf',
    desc: 'Theory and use of the layered-elastic program KENLAYER, including nonlinear and viscoelastic material handling and damage analysis.',
    relatedHws: [{ id: 'hw4', label: 'HW4' }, { id: 'hw8', label: 'HW8' }],
  },
  {
    id: 'ch04', kind: 'chapter', num: '4', title: 'Stresses and Deflections in Rigid Pavements', pdf: 'ch04.pdf',
    desc: 'Curling stresses, Westergaard solutions for interior, edge, and corner loading, and stresses due to friction in concrete slabs.',
    relatedHws: [{ id: 'hw9', label: 'HW9' }],
  },
  {
    id: 'ch05', kind: 'chapter', num: '5', title: 'KENSLABS Computer Program', pdf: 'ch05.pdf',
    desc: 'Finite-element analysis of jointed concrete slabs with KENSLABS: foundations, joints, load transfer, and damage analysis.',
    relatedHws: [{ id: 'hw9', label: 'HW9' }],
  },
  {
    id: 'ch06', kind: 'chapter', num: '6', title: 'Traffic Loading and Volume', pdf: 'ch06.pdf',
    desc: 'Load equivalency factors, truck factors, growth, and lane distribution — turning mixed traffic into design ESALs.',
    relatedHws: [{ id: 'hw5', label: 'HW5' }],
  },
  {
    id: 'ch07', kind: 'chapter', num: '7', title: 'Material Characterization', pdf: 'ch07.pdf',
    desc: 'Resilient modulus, dynamic modulus, fatigue and permanent-deformation properties of pavement materials, and correlations such as CBR.',
    relatedHws: [{ id: 'hw2', label: 'HW2' }],
  },
  {
    id: 'ch08', kind: 'chapter', num: '8', title: 'Drainage Design', pdf: 'ch08.pdf',
    desc: 'Sources of water, estimating inflow, designing permeable bases and filters, and keeping the structure drained.',
    relatedHws: [{ id: 'hw6', label: 'HW6' }],
  },
  {
    id: 'ch09', kind: 'chapter', num: '9', title: 'Pavement Performance', pdf: 'ch09.pdf',
    desc: 'Distress types, serviceability, roughness, skid resistance, and the performance measures that empirical design rests on.',
    relatedHws: [{ id: 'hw1', label: 'HW1' }],
  },
  {
    id: 'ch10', kind: 'chapter', num: '10', title: 'Reliability', pdf: 'ch10.pdf',
    desc: 'Probabilistic design concepts: variability of inputs, reliability levels, and their effect on design thickness.',
    relatedHws: [],
  },
  {
    id: 'ch11', kind: 'chapter', num: '11', title: 'Flexible Pavement Design', pdf: 'ch11.pdf',
    desc: 'Calibrated mechanistic and empirical procedures for flexible pavements, including the Asphalt Institute and AASHTO methods.',
    relatedHws: [{ id: 'hw7', label: 'HW7' }, { id: 'hw8', label: 'HW8' }],
  },
  {
    id: 'ch12', kind: 'chapter', num: '12', title: 'Rigid Pavement Design', pdf: 'ch12.pdf',
    desc: 'PCA and AASHTO procedures for concrete pavements, joint design, and reinforcement.',
    relatedHws: [{ id: 'hw9', label: 'HW9' }],
  },
  {
    id: 'ch13', kind: 'chapter', num: '13', title: 'Design of Overlays', pdf: 'ch13.pdf',
    desc: 'AC and PCC overlays, deflection-based procedures, and rehabilitation design.',
    relatedHws: [{ id: 'hw10', label: 'HW10' }],
  },
  {
    id: 'appendix-a', kind: 'appendix', num: 'A', title: 'Theory of Viscoelasticity', pdf: 'appendix-a.pdf',
    desc: 'Mechanical models, creep compliance, and time–temperature superposition for viscoelastic materials.',
    relatedHws: [],
  },
  {
    id: 'appendix-b', kind: 'appendix', num: 'B', title: 'Theory of Elastic Layer Systems', pdf: 'appendix-b.pdf',
    desc: 'The mathematics behind Burmister layered-elastic theory used by KENLAYER and similar programs.',
    relatedHws: [{ id: 'hw3', label: 'HW3' }],
  },
  {
    id: 'appendix-c', kind: 'appendix', num: 'C', title: 'KENPAVE Software', pdf: 'appendix-c.pdf',
    desc: 'Installation and operation of the KENPAVE suite (KENLAYER and KENSLABS).',
    relatedHws: [{ id: 'hw4', label: 'HW4' }],
  },
  {
    id: 'appendix-d', kind: 'appendix', num: 'D', title: 'An Introduction to Superpave', pdf: 'appendix-d.pdf',
    desc: 'Performance-graded binders and the Superpave mix design system.',
    relatedHws: [{ id: 'hw2', label: 'HW2' }],
  },
  {
    id: 'appendix-e', kind: 'appendix', num: 'E', title: 'Pavement Management Systems', pdf: 'appendix-e.pdf',
    desc: 'Network- and project-level pavement management concepts.',
    relatedHws: [],
  },
  {
    id: 'appendix-f', kind: 'appendix', num: 'F', title: 'A Preview of the 2002 Pavement Design Guide', pdf: 'appendix-f.pdf',
    desc: 'The mechanistic-empirical design guide that became AASHTOWare Pavement ME.',
    relatedHws: [{ id: 'hw8', label: 'HW8' }],
  },
  {
    id: 'appendix-g', kind: 'appendix', num: 'G', title: 'List of Symbols', pdf: 'appendix-g.pdf',
    desc: 'Notation used throughout the book.',
    relatedHws: [],
  },
];

export const chapters = textbook.filter(t => t.kind === 'chapter');
export const appendices = textbook.filter(t => t.kind === 'appendix');

export function getEntry(id: string): TextbookEntry | undefined {
  return textbook.find(t => t.id === id);
}
