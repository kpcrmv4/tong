export const formatThaiPhone = (val: string) => {
  const raw = val.replace(/\D/g, '');
  if (raw.length <= 3) return raw;
  if (raw.length <= 6) return `${raw.slice(0, 3)}-${raw.slice(3)}`;
  return `${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6, 10)}`;
};

export const formatThaiIDCard = (val: string) => {
  const raw = val.replace(/\D/g, '');
  if (raw.length <= 1) return raw;
  if (raw.length <= 5) return `${raw.slice(0, 1)}-${raw.slice(1)}`;
  if (raw.length <= 10) return `${raw.slice(0, 1)}-${raw.slice(1, 5)}-${raw.slice(5)}`;
  if (raw.length <= 12) return `${raw.slice(0, 1)}-${raw.slice(1, 5)}-${raw.slice(5, 10)}-${raw.slice(10)}`;
  return `${raw.slice(0, 1)}-${raw.slice(1, 5)}-${raw.slice(5, 10)}-${raw.slice(10, 12)}-${raw.slice(12, 13)}`;
};
