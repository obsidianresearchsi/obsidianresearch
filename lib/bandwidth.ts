export function shareBandwidth(capacity: number, reserve: number, basicUsers: number, fastUsers: number, basicCap: number, fastCap: number) {
  const usable = capacity * (1 - reserve / 100);
  const groups = [{ users:basicUsers, cap:basicCap, key:"basic" as const },{ users:fastUsers, cap:fastCap, key:"fast" as const }];
  const rates = { basic:0, fast:0 };
  let available = usable;
  let remaining = basicUsers + fastUsers;
  for (const { users, cap, key } of groups.sort((a,b) => a.cap-b.cap)) {
    if (!users) continue;
    const rate = Math.min(cap, available / remaining);
    rates[key] = rate;
    available = Math.max(0, available - users * rate);
    remaining -= users;
  }
  return { rates, usable, demand:basicUsers * basicCap + fastUsers * fastCap, available };
}
