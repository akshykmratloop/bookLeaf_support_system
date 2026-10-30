/**
 * Lua scripts run atomically inside Redis. The keyed queue is a ticket line: `tail` is the last
 * number handed out, `head` the number allowed to run, `lease` proves the head's owner is alive.
 * KEYS = [tail, head, lease]; for every queue script ARGV[2] = lease ms, ARGV[3] = idle ms.
 */

/** Counts one hit; the first hit starts the window. Returns {count, ms until the window ends}. */
export const RATE_HIT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {count, ttl}
`;

/** Takes a number in the line (ARGV[1] = max waiting). Returns it, or 0 when the line is full. */
export const QUEUE_ENTER = `
local tail = tonumber(redis.call('GET', KEYS[1]) or '0')
local head = tonumber(redis.call('GET', KEYS[2]) or tostring(tail + 1))
if tail - head + 1 >= tonumber(ARGV[1]) then return 0 end
local n = redis.call('INCR', KEYS[1])
if n == head then redis.call('SET', KEYS[3], n, 'PX', ARGV[2]) end
redis.call('SET', KEYS[2], head, 'PX', ARGV[3])
redis.call('PEXPIRE', KEYS[1], ARGV[3])
return n
`;

/**
 * Asks whether number ARGV[1] may run. 1 = yes (and its lease is renewed), 0 = keep waiting,
 * -1 = the line moved past it (its owner was presumed dead). A head whose lease ran out is
 * skipped, and the next number gets a fresh lease to notice its turn.
 */
export const QUEUE_TURN = `
local n = tonumber(ARGV[1])
local head = tonumber(redis.call('GET', KEYS[2]) or '0')
if head == 0 or head > n then return -1 end
redis.call('PEXPIRE', KEYS[1], ARGV[3])
redis.call('PEXPIRE', KEYS[2], ARGV[3])
if head == n then
  redis.call('SET', KEYS[3], n, 'PX', ARGV[2])
  return 1
end
if redis.call('EXISTS', KEYS[3]) == 1 then return 0 end
redis.call('SET', KEYS[2], head + 1, 'PX', ARGV[3])
redis.call('SET', KEYS[3], head + 1, 'PX', ARGV[2])
if head + 1 == n then return 1 end
return 0
`;

/** Number ARGV[1] is done: the next number may run (with a fresh lease to notice it). */
export const QUEUE_LEAVE = `
local n = tonumber(ARGV[1])
local head = tonumber(redis.call('GET', KEYS[2]) or '0')
if head ~= n then return 0 end
redis.call('SET', KEYS[2], n + 1, 'PX', ARGV[3])
redis.call('PEXPIRE', KEYS[1], ARGV[3])
local tail = tonumber(redis.call('GET', KEYS[1]) or '0')
if n + 1 <= tail then
  redis.call('SET', KEYS[3], n + 1, 'PX', ARGV[2])
else
  redis.call('DEL', KEYS[3])
end
return 1
`;
