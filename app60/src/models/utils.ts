export function calcAge(dobISO: string) {
    const dob = new Date(dobISO);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  }
  
  export function normalizeDigits(s: string) {
    return s.replace(/\D/g, "");
  }