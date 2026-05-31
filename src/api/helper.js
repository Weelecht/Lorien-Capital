export const getProjects = async() => {
    const queryString = process.env.NODE_ENV === 'development'
        ? `${window.location.origin}/data/projects.json`
        : "/data/projects.json";

    const res = await fetch(queryString, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    })

    if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
    }

    return await res.json();
}