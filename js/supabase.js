import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm"

// TODO: Replace with your actual Supabase credentials
// REAL CREDENTIALS - Updated with user's actual Supabase project
const SUPABASE_URL = "https://yifxjesvzleysizlokrr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZnhqZXN2emxleXNpemxva3JyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NzMwNzEsImV4cCI6MjA4NzE0OTA3MX0.gYYD9eunAVwJTzBykmxgpNjEJJ1Cm5HScJGzY3LEQJE";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Database schema setup SQL (run this in your Supabase SQL editor)
export const DATABASE_SCHEMA = `
-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    location TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('farmer', 'customer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_name TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL CHECK (price > 0),
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    description TEXT,
    image_url TEXT,
    farmer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_per_unit NUMERIC(10,2) NOT NULL,
    total_price NUMERIC(10,2) NOT NULL,
    payment_type TEXT NOT NULL CHECK (payment_type IN ('cod', 'online')),
    delivery_address TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'delivered')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_farmer_id ON products(farmer_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for products
CREATE POLICY "Anyone can view products" ON products
    FOR SELECT USING (true);

CREATE POLICY "Farmers can insert own products" ON products
    FOR INSERT WITH CHECK (
        auth.uid() = farmer_id AND 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'farmer')
    );

CREATE POLICY "Farmers can update own products" ON products
    FOR UPDATE USING (
        auth.uid() = farmer_id AND 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'farmer')
    );

CREATE POLICY "Farmers can delete own products" ON products
    FOR DELETE USING (
        auth.uid() = farmer_id AND 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'farmer')
    );

-- RLS Policies for orders
CREATE POLICY "Users can view own orders" ON orders
    FOR SELECT USING (
        auth.uid() = buyer_id OR 
        auth.uid() IN (
            SELECT farmer_id FROM products WHERE id = orders.product_id
        )
    );

CREATE POLICY "Users can insert orders" ON orders
    FOR INSERT WITH CHECK (
        auth.uid() = buyer_id AND 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'customer')
    );

CREATE POLICY "Farmers can update order status" ON orders
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT farmer_id FROM products WHERE id = orders.product_id
        ) AND 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'farmer')
    );

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, name, phone, location, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'name', 'Unknown User'),
        COALESCE(NEW.raw_user_meta_data->>'phone', NEW.raw_user_meta_data->>'phone', '0000000000'),
        COALESCE(NEW.raw_user_meta_data->>'location', NEW.raw_user_meta_data->>'location', 'Unknown'),
        COALESCE(NEW.raw_user_meta_data->>'role', NEW.raw_user_meta_data->>'role', 'farmer')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix existing profile with metadata
CREATE OR REPLACE FUNCTION public.fix_profile_metadata()
RETURNS void AS $$
BEGIN
    UPDATE public.profiles 
    SET 
        name = COALESCE(
            (SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = profiles.id),
            (SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = profiles.id),
            profiles.name
        ),
        phone = COALESCE(
            (SELECT raw_user_meta_data->>'phone' FROM auth.users WHERE id = profiles.id),
            (SELECT raw_user_meta_data->>'phone' FROM auth.users WHERE id = profiles.id),
            profiles.phone
        ),
        location = COALESCE(
            (SELECT raw_user_meta_data->>'location' FROM auth.users WHERE id = profiles.id),
            (SELECT raw_user_meta_data->>'location' FROM auth.users WHERE id = profiles.id),
            profiles.location
        ),
        role = COALESCE(
            (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = profiles.id),
            (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = profiles.id),
            profiles.role
        )
    WHERE id IN (
        SELECT id FROM auth.users 
        WHERE raw_user_meta_data IS NOT NULL 
        AND (raw_user_meta_data->>'name' IS NOT NULL 
             OR raw_user_meta_data->>'phone' IS NOT NULL 
             OR raw_user_meta_data->>'location' IS NOT NULL)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RPC function for placing orders
CREATE OR REPLACE FUNCTION place_order(
    p_product_id UUID,
    p_quantity INTEGER,
    p_delivery_address TEXT,
    p_payment_type TEXT
)
RETURNS JSON AS $$
DECLARE
    v_product RECORD;
    v_total_price NUMERIC;
    v_order_id UUID;
BEGIN
    -- Lock the product row to prevent race conditions
    SELECT * INTO v_product 
    FROM products 
    WHERE id = p_product_id 
    FOR UPDATE;
    
    -- Check if product exists
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Product not found');
    END IF;
    
    -- Check if sufficient quantity is available
    IF v_product.quantity < p_quantity THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient quantity available');
    END IF;
    
    -- Calculate total price
    v_total_price := v_product.price * p_quantity;
    
    -- Create the order
    INSERT INTO orders (
        product_id, 
        buyer_id, 
        quantity, 
        price_per_unit, 
        total_price,
        delivery_address, 
        payment_type
    ) VALUES (
        p_product_id,
        auth.uid(),
        p_quantity,
        v_product.price,
        v_total_price,
        p_delivery_address,
        p_payment_type
    ) RETURNING id INTO v_order_id;
    
    -- Update product quantity
    UPDATE products 
    SET quantity = quantity - p_quantity,
        updated_at = NOW()
    WHERE id = p_product_id;
    
    -- Return success response
    RETURN json_build_object(
        'success', true, 
        'order_id', v_order_id,
        'total_price', v_total_price,
        'message', 'Order placed successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for product images
CREATE POLICY "Anyone can view product images" ON storage.objects
    FOR SELECT USING (bucket_id = 'products');

CREATE POLICY "Farmers can upload product images" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'products' AND 
        auth.uid()::text = (SPLIT_PART(name, '/', 1))
    );

CREATE POLICY "Farmers can update own product images" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'products' AND 
        auth.uid()::text = (SPLIT_PART(name, '/', 1))
    );

CREATE POLICY "Farmers can delete own product images" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'products' AND 
        auth.uid()::text = (SPLIT_PART(name, '/', 1))
    );
`;

// Helper function to check if user is authenticated
export const isAuthenticated = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
};

// Helper function to get user profile
export const getUserProfile = async (userId) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    return { data, error };
};

// Helper function to upload image to Supabase Storage
export const uploadImage = async (file, userId) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
        .from('products')
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
        });
    
    if (error) {
        return { data: null, error };
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
        .from('products')
        .getPublicUrl(fileName);
    
    return { data: publicUrl, error: null };
};