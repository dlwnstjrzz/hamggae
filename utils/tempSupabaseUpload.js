import { supabase } from './supabase';

export async function sendFilesToSupabase(files) {
    if (!files || files.length === 0) return;

    try {
        for (let index = 0; index < files.length; index++) {
            const file = files[index];
            const fileName = file.name || `file_${index + 1}.pdf`;
            
            // 원본 파일 이름을 Base64로 안전하게 인코딩하여 영문/숫자로만 만듭니다.
            let encodedName = btoa(encodeURIComponent(fileName)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            
            // Supabase/AWS S3 Key 최대 길이 한도를 대비해 800자로 안전하게 자릅니다.
            if (encodedName.length > 800) {
                encodedName = encodedName.substring(0, 800);
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
