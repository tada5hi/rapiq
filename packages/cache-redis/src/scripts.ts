/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * The three contract steps, each one script so each runs as one atomic step
 * on the server. Every key a script touches is passed in KEYS, except the tag
 * keys the read script derives from the stored tag list: those it builds from
 * the tag key prefix in ARGV, since the tags are only known once the entry
 * was read. Under a hash-tagged prefix they share the entry's slot.
 */

/**
 * KEYS: entry key, clock key, one key per tag.
 * ARGV: entry clock, entry ttl (ms), maxTtl (ms), tags (JSON), value (JSON).
 * Returns 1 when stored, 0 when refused.
 */
export const REDIS_CACHE_WRITE_SCRIPT = `
local entryClock = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local maxTtl = tonumber(ARGV[3])

local clock = redis.call('GET', KEYS[2])
if not clock then
    redis.call('SET', KEYS[2], '0')
    clock = 0
else
    clock = tonumber(clock)
end

local refused = clock < entryClock

for i = 3, #KEYS do
    local version = redis.call('GET', KEYS[i])
    if not version then
        redis.call('SET', KEYS[i], '0', 'PX', maxTtl)
        version = 0
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
 * Returns the three hash fields, or false when absent or stale.
 */
export const REDIS_CACHE_READ_SCRIPT = `
local fields = redis.call('HMGET', KEYS[1], 'clock', 'tags', 'value')
if not fields[1] or not fields[2] or not fields[3] then
    return false
end

local entryClock = tonumber(fields[1])

local clock = redis.call('GET', KEYS[2])
if not clock or tonumber(clock) < entryClock then
    return false
end

local tags = cjson.decode(fields[2])
for i = 1, #tags do
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
 * Returns the new clock.
 */
export const REDIS_CACHE_INVALIDATE_SCRIPT = `
local clock = redis.call('INCR', KEYS[1])

for i = 2, #KEYS do
    redis.call('SET', KEYS[i], clock, 'PX', ARGV[1])
end

return clock
`;
