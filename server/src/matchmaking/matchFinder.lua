local queueKey = KEYS[1]
local minElo = tonumber(ARGV[1])
local maxElo = tonumber(ARGV[2])
local playerUuid = ARGV[3]

local candidates = redis.call('ZRANGEBYSCORE', queueKey, minElo, maxElo)
for _, opponentUuid in ipairs(candidates) do
    if opponentUuid ~= playerUuid then
        redis.call('ZREM', queueKey, playerUuid)
        redis.call('ZREM', queueKey, opponentUuid)
        return {playerUuid, opponentUuid}
    end
end
return nil
