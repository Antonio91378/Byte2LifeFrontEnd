export const DETAIL_LEVELS = [
  { value: 0, label: 'Baixo', info: 'Nozzle 0.4mm, Camada 0.24mm. Resolução mais baixa, ideal para peças funcionais ou rascunhos.' },
  { value: 1, label: 'Normal', info: 'Nozzle 0.4mm, Camada 0.20mm. Equilíbrio padrão entre qualidade e tempo.' },
  { value: 2, label: 'Alto', info: 'Nozzle 0.4mm, Camada 0.12mm. Superfície mais lisa, detalhes mais definidos.' },
  { value: 3, label: 'Extremo', info: 'Nozzle 0.2mm, Camada 0.06-0.1mm. Máxima definição, tempo de impressão significativamente maior.' },
];

export const getDetailLevelLabel = (value: number) => {
  const level = DETAIL_LEVELS.find(l => l.value === value);
  return level ? level.label : 'Desconhecido';
};
