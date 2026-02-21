import { supabase } from "./supabase.js";

export async function getUsers(){
return await supabase
.from("users")
.select("*");
}

export async function deleteProduct(id){
await supabase
.from("products")
.delete()
.eq("id",id);
}