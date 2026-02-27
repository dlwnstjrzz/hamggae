import { supabase } from './supabase';

export async function sendFilesToSupabase(files) {
    if (!files || files.length === 0) return;

    try {
        for (let index = 0; index < files.length; index++) {
            const file = files[index];
            const fileName = file.name || `file_${index + 1}.pdf`;
            
            // 원본 파일 이름을 Base64로 안전하게 인코딩하여 영문/숫자로만 만듭니다.
            // 나중에 어드민 페이지에서 원래 한글 이름으로 완벽하게 복원(디코딩)할 수 있습니다.
            let encodedName = btoa(encodeURIComponent(fileName)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            
            // Supabase/OS의 파일명 길이 제한(통상 255바이트)을 대비해 인코딩된 이름이 너무 길면 잘라냅니다.
            if (encodedName.length > 150) {
                encodedName = encodedName.substring(0, 150);
            }

            const uniqueFileName = `${Date.now()}_${encodedName}.pdf`;
            
            console.log(`Uploading ${index + 1}/${files.length}: ${fileName}...`);
            
            // 'hamggae-file' 버킷에 파일을 업로드합니다.
            const { data, error } = await supabase
                .storage
                .from('hamggae-file')
                .upload(uniqueFileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                console.error(`Error uploading ${fileName}:`, error.message);
            } else {
                console.log(`Successfully uploaded ${fileName}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        console.log("All files uploaded successfully.");
    } catch (error) {
        console.error("Error sending files to Supabase:", error);
    }
}
