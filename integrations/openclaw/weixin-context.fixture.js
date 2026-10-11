// Tencent openclaw-weixin 2.4.9 context construction excerpt, MIT.
export function weixinMessageToMsgContext(msg, accountId, opts) {
    const from_user_id = msg.from_user_id ?? "";
    const ctx = {
        Body: bodyFromItemList(msg.item_list),
        From: from_user_id,
        To: from_user_id,
        AccountId: accountId,
        OriginatingChannel: "openclaw-weixin",
        OriginatingTo: from_user_id,
        MessageSid: generateMessageSid(),
        Timestamp: msg.create_time_ms,
        Provider: "openclaw-weixin",
        ChatType: "direct",
    };
    if (msg.context_token) {
        ctx.context_token = msg.context_token;
    }
    const providerMessageId = getWeixinMessageId(msg);
    if (providerMessageId)
        ctx.MessageSidFull = providerMessageId;
    return ctx;
}
