FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build
WORKDIR /src
COPY . .
RUN dotnet publish -c Release -o /app

FROM mcr.microsoft.com/dotnet/sdk:10.0-preview
WORKDIR /app
COPY --from=build /app .

# Install Aspire CLI
RUN dotnet tool install -g aspire
ENV PATH="$PATH:/root/.dotnet/tools"

# Install Node.js for TypeScript support
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g typescript ts-node

RUN useradd -m coderunner
USER coderunner
ENV PATH="$PATH:/home/coderunner/.dotnet/tools"
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "AspireAcademy.CodeRunner.dll"]
