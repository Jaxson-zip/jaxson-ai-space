// Tencent openclaw-weixin 2.4.9 entry excerpt, MIT.
export async function processOneMessage(full, deps) {
    if (!deps?.channelRuntime) {
        logger.error(`processOneMessage: channelRuntime is undefined, skipping message from=${full.from_user_id}`);
        deps.errLog("processOneMessage: channelRuntime is undefined, skip");
        return;
    }
    const receivedAt = Date.now();
}
