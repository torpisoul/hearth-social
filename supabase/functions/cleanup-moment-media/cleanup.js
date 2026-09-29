export async function cleanupMomentMedia(db) {
 const {data,error}=await db.rpc('hearth_orphan_moment_images');
 if(error)throw error;
 const paths=(data||[]).map(row=>row.path);
 if(paths.length){const {error}=await db.storage.from('hearth-moments').remove(paths);if(error)throw error;}
 return {removed:paths.length};
}
