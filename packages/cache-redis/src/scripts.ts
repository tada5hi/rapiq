/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * The contract steps, each one script so each runs as one atomic step on
 * the server. Every key a script touches is passed in KEYS, except the tag
 * keys the read script derives from the stored tag list: those it builds
 * from the tag key prefix in ARGV, since the tags are only known once the
 * entry was read. Under a hash-tagged prefix they share the entry's slot.
 *
 * A clock the store does not hold is SEEDED from the server time in
 * microseconds rather than restarted at 0: a lost clock key then restarts
 * above every value the lost counter handed out (at fewer than one bump
 * per microsecond on average), so a pre-loss entry can never read as fresh
 * again once the counter climbs back. The value stays below 2^53, so a
 * double holds it exactly, for the next two centuries.
 *
 * A clock is always written through `string.format('%.0f')`: Redis turns
 * a Lua number argument into a string with a limited precision, which a
 * microsecond timestamp exceeds.
 */
const REDIS_CACHE_SCRIPT_SEED = `
-- TIME is non-deterministic: before Redis 5 a script calling it may write
-- only under effects replication (a no-op from Redis 7 on).
if redis.replicate_commands then
    redis.replicate_commands()
end

local function seed()
    local time = redis.call('TIME')
    return tonumber(time[1]) * 1000000 + tonumber(time[2])
end

local function format(value)
    return string.format('%.0f', value)
end
`;

/**
 * KEYS: clock key.
 * Returns the clock as a string, seeding and storing it when absent.
 */
export const REDIS_CACHE_CLOCK_SCRIPT = `${REDIS_CACHE_SCRIPT_SEED}
local clock = redis.call('GET', KEYS[1])
if not clock then
    clock = format(seed())
    redis.call('SET', KEYS[1], clock)
end

return clock
`;

/**
 * KEYS: entry key, clock key, one key per tag.
 * ARGV: entry clock, entry ttl (ms), maxTtl (ms), tags (JSON), value (JSON).
 * Returns 1 when stored, 0 when refused.
 */
export const REDIS_CACHE_WRITE_SCRIPT = `${REDIS_CACHE_SCRIPT_SEED}
local function integer(value)
    local number = tonumber(value)
    if not number or number ~= number or number == math.huge or number == -math.huge then
        return nil
    end

    if number ~= math.floor(number) then
        return nil
    end

    return number
end

local entryClock = integer(ARGV[1])
local ttl = integer(ARGV[2])
local maxTtl = integer(ARGV[3])

-- checked before the first write: a failing PEXPIRE after the HSET would
-- leave an entry without an expiry, since a script is not rolled back.
if not entryClock or not ttl or not maxTtl or entryClock < 0 or ttl < 1 or maxTtl < 1 or
    string.sub(ARGV[4], 1, 1) ~= '[' then
    return redis.error_reply('rapiq cache: invalid write arguments')
end

local clock = redis.call('GET', KEYS[2])
if not clock then
    clock = seed()
    redis.call('SET', KEYS[2], format(clock))
else
    clock = tonumber(clock)
end

local refused = clock < entryClock

for i = 3, #KEYS do
    local version = redis.call('GET', KEYS[i])
    if not version then
        -- an absent tag has an unknown history (evicted, or lapsed after a
        -- bump), so it is re-created as bumped now, never as 0.
        redis.call('SET', KEYS[i], format(clock), 'PX', maxTtl)
        version = clock
    else
        redis.call('PEXPIRE', KEYS[i], maxTtl)
        version = tonumber(version)
    end

    if version > entryClock then
        refused = true
    end
end

if refused then
    return 0
end

redis.call('DEL', KEYS[1])
redis.call('HSET', KEYS[1], 'clock', ARGV[1], 'tags', ARGV[4], 'value', ARGV[5])
redis.call('PEXPIRE', KEYS[1], ttl)

return 1
`;

/**
 * KEYS: entry key, clock key.
 * ARGV: the tag key prefix (`<prefix>:t:`).
 * Returns the three hash fields, or false when absent or stale. A stale
 * entry is deleted, as is one no legitimate write can have produced: a
 * clock ahead of the store's, or a tag list that does not decode.
 */
export const REDIS_CACHE_READ_SCRIPT = `
local fields = redis.call('HMGET', KEYS[1], 'clock', 'tags', 'value')
if not fields[1] or not fields[2] or not fields[3] then
    return false
end

local entryClock = tonumber(fields[1])
if entryClock and (entryClock ~= entryClock or entryClock == math.huge or entryClock == -math.huge) then
    entryClock = nil
end

local clock = redis.call('GET', KEYS[2])
if not entryClock or not clock or tonumber(clock) < entryClock then
    redis.call('DEL', KEYS[1])
    return false
end

-- a tag list is a JSON array; an object decodes to a table too, and would
-- read as an entry with no tags at all.
local ok, tags = pcall(cjson.decode, fields[2])
if not ok or type(tags) ~= 'table' or string.sub(fields[2], 1, 1) ~= '[' then
    redis.call('DEL', KEYS[1])
    return false
end

for i = 1, #tags do
    if type(tags[i]) ~= 'string' then
        redis.call('DEL', KEYS[1])
        return false
    end

    local version = redis.call('GET', ARGV[1] .. tags[i])
    if not version or tonumber(version) > entryClock then
        redis.call('DEL', KEYS[1])
        return false
    end
end

return fields
`;

/**
 * KEYS: clock key, one key per tag.
 * ARGV: maxTtl (ms).
 * Returns the new clock as a string.
 */
export const REDIS_CACHE_INVALIDATE_SCRIPT = `${REDIS_CACHE_SCRIPT_SEED}
local clock = redis.call('GET', KEYS[1])
if not clock then
    clock = seed()
else
    clock = tonumber(clock)
end

clock = format(clock + 1)
redis.call('SET', KEYS[1], clock)

for i = 2, #KEYS do
    redis.call('SET', KEYS[i], clock, 'PX', ARGV[1])
end

return clock
`;
